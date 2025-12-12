/**
 * Project Manager
 *
 * Manages multiple projects/brands and their configurations
 * Stores data in Firebase for persistence
 */
const admin = require('firebase-admin');
const config = require('../config');

// Initialize Firebase if credentials provided
let db = null;
if (config.firebaseCredentials) {
  try {
    const creds = JSON.parse(config.firebaseCredentials);
    admin.initializeApp({
      credential: admin.credential.cert(creds)
    });
    db = admin.firestore();
  } catch (e) {
    console.log('[ProjectManager] Firebase not configured, using in-memory storage');
  }
}

// In-memory storage fallback
const inMemoryProjects = new Map();
const inMemoryCommits = new Map();

/**
 * Project schema:
 * {
 *   id: string,
 *   name: string,
 *   githubRepo: string,  // e.g., "username/repo"
 *   brand: {
 *     name: string,
 *     voice: string,     // 'casual-founder', 'professional', 'technical', 'playful'
 *     platforms: string[], // ['twitter', 'linkedin']
 *     accountHandle: string
 *   },
 *   tagging: {
 *     alwaysTag: string[],
 *     topicTags: { [topic]: string[] }
 *   },
 *   postFrequency: string, // 'daily-digest', 'weekly', 'per-milestone'
 *   slackChannel: string,
 *   active: boolean,
 *   createdAt: Date,
 *   updatedAt: Date
 * }
 */

class ProjectManager {
  /**
   * Create a new project
   */
  async createProject(projectData) {
    const id = projectData.id || this.generateId(projectData.name);

    const project = {
      id,
      name: projectData.name,
      githubRepo: projectData.githubRepo,
      brand: {
        name: projectData.brand?.name || projectData.name,
        voice: projectData.brand?.voice || 'casual-founder',
        platforms: projectData.brand?.platforms || ['twitter'],
        accountHandle: projectData.brand?.accountHandle || null
      },
      tagging: projectData.tagging || {
        alwaysTag: [],
        topicTags: {}
      },
      postFrequency: projectData.postFrequency || 'daily-digest',
      slackChannel: projectData.slackChannel || config.slackChannel,
      active: projectData.active !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (db) {
      await db.collection('shippost_projects').doc(id).set(project);
    } else {
      inMemoryProjects.set(id, project);
    }

    return project;
  }

  /**
   * Get a project by ID
   */
  async getProject(id) {
    if (db) {
      const doc = await db.collection('shippost_projects').doc(id).get();
      return doc.exists ? doc.data() : null;
    }
    return inMemoryProjects.get(id) || null;
  }

  /**
   * Get project by GitHub repo
   */
  async getProjectByRepo(githubRepo) {
    if (db) {
      const snapshot = await db.collection('shippost_projects')
        .where('githubRepo', '==', githubRepo)
        .limit(1)
        .get();

      return snapshot.empty ? null : snapshot.docs[0].data();
    }

    for (const project of inMemoryProjects.values()) {
      if (project.githubRepo === githubRepo) return project;
    }
    return null;
  }

  /**
   * Get all active projects
   */
  async getActiveProjects() {
    if (db) {
      const snapshot = await db.collection('shippost_projects')
        .where('active', '==', true)
        .get();

      return snapshot.docs.map(doc => doc.data());
    }

    return Array.from(inMemoryProjects.values()).filter(p => p.active);
  }

  /**
   * Update a project
   */
  async updateProject(id, updates) {
    const project = await this.getProject(id);
    if (!project) return null;

    const updated = {
      ...project,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    if (db) {
      await db.collection('shippost_projects').doc(id).update(updated);
    } else {
      inMemoryProjects.set(id, updated);
    }

    return updated;
  }

  /**
   * Delete a project
   */
  async deleteProject(id) {
    if (db) {
      await db.collection('shippost_projects').doc(id).delete();
    } else {
      inMemoryProjects.delete(id);
    }
  }

  /**
   * Store a commit for a project
   */
  async storeCommit(projectId, commit) {
    const commitData = {
      projectId,
      sha: commit.sha || commit.id,
      message: commit.message,
      author: commit.author,
      timestamp: commit.timestamp || new Date().toISOString(),
      filesChanged: commit.filesChanged || 0,
      processed: false
    };

    if (db) {
      await db.collection('shippost_commits').add(commitData);
    } else {
      const commits = inMemoryCommits.get(projectId) || [];
      commits.push(commitData);
      inMemoryCommits.set(projectId, commits);
    }

    return commitData;
  }

  /**
   * Get unprocessed commits for a project (today's commits)
   */
  async getUnprocessedCommits(projectId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (db) {
      const snapshot = await db.collection('shippost_commits')
        .where('projectId', '==', projectId)
        .where('processed', '==', false)
        .where('timestamp', '>=', today.toISOString())
        .get();

      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    const commits = inMemoryCommits.get(projectId) || [];
    return commits.filter(c => !c.processed && new Date(c.timestamp) >= today);
  }

  /**
   * Mark commits as processed
   */
  async markCommitsProcessed(commitIds) {
    if (db) {
      const batch = db.batch();
      for (const id of commitIds) {
        batch.update(db.collection('shippost_commits').doc(id), { processed: true });
      }
      await batch.commit();
    } else {
      // In-memory: find and mark
      for (const [projectId, commits] of inMemoryCommits.entries()) {
        for (const commit of commits) {
          if (commitIds.includes(commit.id || commit.sha)) {
            commit.processed = true;
          }
        }
      }
    }
  }

  /**
   * Generate a URL-safe ID from a name
   */
  generateId(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}

module.exports = new ProjectManager();
